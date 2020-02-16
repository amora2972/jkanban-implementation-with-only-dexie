import {ITicket} from './ticket.interface';

export interface IColumn {
  id?: string;
  title: string;
  item?: ITicket[];
}
